import Link from 'next/link'
import { SITE_NAME } from '@/lib/site-api'

/** 页脚:备案号走 env,没有就不渲染 */
export function SiteFooter() {
    const icp = process.env.NEXT_PUBLIC_ICP
    return (
        <footer className="mt-20 border-t border-border py-9 text-[13px] text-muted-foreground">
            <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6">
                <span>© {new Date().getFullYear()} {SITE_NAME}</span>
                <span>
                    {icp ? (
                        <a href="https://beian.miit.gov.cn/" rel="nofollow noopener" className="hover:text-accent">
                            {icp}
                        </a>
                    ) : null}
                </span>
                <span className="flex gap-3">
                    <a href="/rss.xml" className="hover:text-accent">RSS</a>
                    <a href="/llms.txt" className="hover:text-accent">llms.txt</a>
                </span>
            </div>
        </footer>
    )
}
