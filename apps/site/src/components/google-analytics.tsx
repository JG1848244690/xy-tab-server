import Script from 'next/script'

/**
 * Google Analytics 4。
 *
 * 只有配置了 NEXT_PUBLIC_GA_ID 才注入;默认值写死成当前属性,
 * 这样即使 CI 没配 secret,上线也能正常统计。
 *
 * 用 afterInteractive:不阻塞首屏,SEO 和性能都不受影响。
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-8G9Z0D542X'

export function GoogleAnalytics() {
    if (!GA_ID) return null
    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
                strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
                {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}', { anonymize_ip: true });
                `}
            </Script>
        </>
    )
}
