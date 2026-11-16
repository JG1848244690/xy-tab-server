import { SITE_NAME } from '@/lib/site-api'

/** 页脚:备案号优先取 env,未配置时用主域备案号兜底 */
export function SiteFooter() {
    const icp = process.env.NEXT_PUBLIC_ICP || '晋ICP备2026005328号'
    return (
        <footer className="mt-24 border-t border-border py-8 text-[12px] text-muted-foreground">
            <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-baseline">
                    <span className="font-serif text-[13px] text-foreground">
                        {SITE_NAME} · 由社区共同维护
                    </span>
                    <span className="flex items-baseline gap-4">
                        <span>© {new Date().getFullYear()}</span>
                        <a href="/rss.xml" className="hover:text-accent">RSS</a>
                        <a href="/llms.txt" className="hover:text-accent">llms.txt</a>
                    </span>
                </div>

                {/* 声明:备案要求展示,同时把使用边界说清楚 */}
                <div className="mt-4 space-y-1 border-t border-border/60 pt-4 text-[11px] leading-6 text-muted-foreground/90">
                    <p>
                        本站为个人学习与技术交流用途,内容由公开资料整理与个人实践撰写,仅供学习参考,
                        <strong className="font-normal text-foreground/80">不构成任何技术、法律或商业建议</strong>。
                        因参考本站内容产生的任何后果,本站不承担责任。
                    </p>
                    <p>
                        内容如有错误或侵权,欢迎通过
                        <a href="mailto:1848244690@qq.com" className="mx-1 hover:text-accent">邮件</a>
                        指出,核实后会及时更正或删除。
                        <a
                            href="https://beian.miit.gov.cn/"
                            target="_blank"
                            rel="nofollow noopener"
                            className="ml-2 hover:text-accent"
                        >
                            {icp}
                        </a>
                    </p>
                </div>
            </div>
        </footer>
    )
}
