import packageJson from '../../package.json' with { type: 'json' };
import { apiReference } from "@scalar/hono-api-reference";
import env from '../env.js';
export default function configureOpenAPI(app) {
    // B6:生产默认不注册 /doc 与 /reference —— 那是给攻击者免费送的
    // 完整 API 面(参数、字段、错误形状)。确要调试时在 .env 里
    // ENABLE_API_DOCS=true 重启即可,平时保持关。
    const docsEnabled = env.NODE_ENV !== 'production' || env.ENABLE_API_DOCS === 'true';
    // 生产挂在 nginx /api 反代后:OPENAPI_BASE_PATH='/api'
    //   → spec 写 servers,Scalar 的 curl / Try it out 自动拼成 /api/tasks
    // 本机直连:OPENAPI_BASE_PATH='' → 不写 servers,默认用 doc host
    const servers = env.OPENAPI_BASE_PATH
        ? [{ url: env.OPENAPI_BASE_PATH }]
        : undefined;
    if (!docsEnabled)
        return;
    app.doc('/doc', {
        openapi: '3.0.0',
        info: {
            version: packageJson.version,
            title: 'hlsEdu API'
        },
        ...(servers ? { servers } : {})
    });
    app.get('/reference', apiReference({
        defaultHttpClient: {
            targetKey: 'javascript',
            clientKey: 'fetch'
        },
        spec: {
            // Scalar 拉 spec 的地址同样要带前缀;空串时退化为 /doc
            url: `${env.OPENAPI_BASE_PATH}/doc`
        }
    }));
}
