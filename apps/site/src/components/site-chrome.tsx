import Link from 'next/link'

/** 页脚:备案号走 env,没有就不渲染 */
export function SiteFooter() {
    const icp = process.env.NEXT_PUBLIC_ICP
    return (
        <footer className="site-footer">
            <div className="container">
                <span>© {new Date().getFullYear()} HLS 面试题库</span>
                <span>
                    {icp ? (
                        <a href="https://beian.miit.gov.cn/" rel="nofollow noopener">
                            {icp}
                        </a>
                    ) : null}
                </span>
                <span>
                    <a href="/rss.xml">RSS</a>
                    {' · '}
                    <a href="/llms.txt">llms.txt</a>
                </span>
            </div>
        </footer>
    )
}
