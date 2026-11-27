import { createHmac, createPrivateKey } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { eq } from 'drizzle-orm'
import Provider, { errors, type Configuration } from 'oidc-provider'
import db from '../../../db/index.js'
import { users } from '../../../db/schema.js'
import env from '../../../env.js'
import { PgOAuthAdapter } from './adapter.js'
import { grantLifetime, oauth, scopes } from './config.js'

let provider: Provider | undefined

export function oauthProvider() {
    if (!oauth) return undefined
    if (provider) return provider
    const { issuer, resource, publicPrefix, secure } = oauth
    const publicRoute = (path: string) => publicPrefix + '/oauth/' + path
    const derive = (label: string) => createHmac('sha256', env.JWT_SECRET).update('hlsedu-oauth:' + label).digest()
    const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), derive('jwks')])
    const signingKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' }).export({ format: 'jwk' })
    const configuration: Configuration = {
        adapter: PgOAuthAdapter,
        clientDefaults: {
            grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
            token_endpoint_auth_method: 'none', id_token_signed_response_alg: 'EdDSA',
        },
        clientAuthMethods: ['none', 'client_secret_basic', 'client_secret_post'],
        responseTypes: ['code'],
        scopes: [...scopes, 'offline_access'],
        jwks: { keys: [{ ...signingKey, alg: 'EdDSA', use: 'sig', kid: 'hlsedu-oauth-1' }] },
        enabledJWA: { idTokenSigningAlgValues: ['EdDSA'] },
        cookies: {
            keys: [derive('cookies').toString('base64url')],
            short: { secure, httpOnly: true, sameSite: 'lax' },
            long: { secure, httpOnly: true, sameSite: 'lax' },
        },
        routes: {
            authorization: publicRoute('authorize'),
            token: publicRoute('token'),
            registration: publicRoute('register'),
            revocation: publicRoute('revoke'),
            jwks: publicRoute('jwks'),
        },
        pkce: { required: () => true },
        allowOmittingSingleRegisteredRedirectUri: false,
        issueRefreshToken: async (_ctx, client) => client.grantTypeAllowed('refresh_token'),
        rotateRefreshToken: true,
        expiresWithSession: async () => false,
        ttl: { AuthorizationCode: 300, AccessToken: 900, RefreshToken: grantLifetime, Grant: grantLifetime, Interaction: 600 },
        interactions: { url: async (_ctx, interaction) => publicRoute('interaction/' + interaction.uid) },
        async loadExistingGrant(ctx) {
            const grantId = ctx.oidc.result?.consent?.grantId
            return grantId ? ctx.oidc.provider.Grant.find(grantId) : undefined
        },
        async findAccount(_ctx, id) {
            const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1)
            return user ? { accountId: user.id, claims: async () => ({ sub: user.id }) } : undefined
        },
        features: {
            devInteractions: { enabled: false },
            registration: { enabled: true, issueRegistrationAccessToken: false },
            revocation: {
                enabled: true,
                allowedPolicy: async (_ctx, client, token) => client.clientId === token.clientId,
            },
            userinfo: { enabled: false },
            rpInitiatedLogout: { enabled: false },
            resourceIndicators: {
                enabled: true,
                useGrantedResource: async () => true,
                defaultResource: async () => resource,
                async getResourceServerInfo(_ctx, candidate) {
                    if (candidate !== resource) throw new errors.InvalidTarget('Unknown MCP resource')
                    return { scope: scopes.join(' '), audience: resource, accessTokenFormat: 'opaque' }
                },
            },
        },
    }
    provider = new Provider(issuer, configuration)
    provider.proxy = true
    provider.use(async (ctx, next) => {
        await next()
        if (ctx.path === '/.well-known/openid-configuration' && ctx.status === 200 && ctx.body && typeof ctx.body === 'object') {
            Object.assign(ctx.body, { scopes_supported: [...scopes, 'offline_access'] })
        }
    })
    provider.on('server_error', (_ctx, error) => console.error('MCP OAuth provider error', error.name))
    return provider
}

export function providerRequest(req: IncomingMessage, path: string) {
    const issuer = new URL(oauth!.issuer)
    req.url = path
    req.headers['x-forwarded-proto'] = issuer.protocol.slice(0, -1)
    req.headers['x-forwarded-host'] = issuer.host
    return req
}

export function delegate(provider: Provider, req: IncomingMessage, res: ServerResponse) {
    return new Promise<void>((resolve, reject) => {
        res.once('finish', resolve)
        res.once('close', resolve)
        Promise.resolve(provider.callback()(req, res)).catch(reject)
    })
}
