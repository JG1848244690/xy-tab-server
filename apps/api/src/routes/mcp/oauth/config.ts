import env from '../../../env.js'

export const scopes = ['todos:read', 'todos:write'] as const
export const grantLifetime = 30 * 86_400

export const oauth = (() => {
    if (!env.MCP_OAUTH_ISSUER) return undefined
    const issuer = new URL(env.MCP_OAUTH_ISSUER)
    if (issuer.pathname !== '/' || issuer.search || issuer.hash || issuer.username || issuer.password
        || (issuer.protocol !== 'https:' && !(issuer.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(issuer.hostname)))) {
        throw new Error('MCP_OAUTH_ISSUER must be an HTTPS origin (loopback HTTP is allowed for development)')
    }
    const resourcePath = env.MCP_OAUTH_RESOURCE_PATH
    if (!/^\/(?:[a-zA-Z0-9_-]+\/)*mcp$/.test(resourcePath)) {
        throw new Error('MCP_OAUTH_RESOURCE_PATH must be an absolute path ending in /mcp')
    }
    return {
        issuer: issuer.origin,
        resource: issuer.origin + resourcePath,
        metadataPath: '/.well-known/oauth-protected-resource' + resourcePath,
        publicPrefix: resourcePath.slice(0, -4),
        secure: issuer.protocol === 'https:',
    }
})()
