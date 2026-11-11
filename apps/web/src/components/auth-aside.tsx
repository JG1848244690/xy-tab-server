interface AuthAsideProps {
    title?: string
    description?: string
}

/**
 * 登录/注册页右侧的「书页」aside。
 * 深墨底 + 宋体标题 + 朱砂点缀,和前台首页的编辑气质一致;
 * 不做渐变卡片和 3D 倾斜,静态版更稳,也不吃性能。
 */
export function AuthAside({
    title = '欢迎回来',
    description = '继续维护这座题库:审题、归档、写文章。',
}: AuthAsideProps) {
    return (
        <div className="relative hidden overflow-hidden border-l border-border bg-[#16150f] text-[#ece7da] lg:flex lg:w-1/2 xl:w-3/5">
            {/* 大号「序」水印 */}
            <span
                aria-hidden
                className="pointer-events-none absolute -right-10 -bottom-16 select-none font-serif text-[26rem] leading-none text-white/[0.035]"
            >
                序
            </span>

            <div className="relative z-10 flex h-full w-full flex-col justify-between p-12 xl:p-16">
                <div className="flex items-baseline gap-3 font-mono text-[10.5px] tracking-[0.22em] text-[#a39c8b]">
                    <span>SEQUENCE</span>
                    <span className="h-px w-8 bg-[#3a362c]" />
                    <span>EDITOR CONSOLE</span>
                </div>

                <div>
                    <h2 className="max-w-[14ch] text-balance font-serif text-[44px] leading-[1.15] tracking-[-0.02em] text-[#f2ede0] xl:text-[52px]">
                        {title}
                    </h2>
                    <p className="mt-5 max-w-[32ch] text-[14px] leading-7 text-[#a39c8b]">
                        {description}
                    </p>

                    <div className="mt-10 grid gap-3 border-t border-[#2f2c25] pt-6 font-mono text-[11px] text-[#a39c8b]">
                        <div className="flex items-baseline gap-3">
                            <span className="text-[#e0645a]">01</span>
                            <span>审题:AI 预审 + 人工裁决</span>
                        </div>
                        <div className="flex items-baseline gap-3">
                            <span className="text-[#e0645a]">02</span>
                            <span>归档:题库 / 标签 / 合集</span>
                        </div>
                        <div className="flex items-baseline gap-3">
                            <span className="text-[#e0645a]">03</span>
                            <span>发布:定时构建同步前台</span>
                        </div>
                    </div>
                </div>

                <p className="font-serif text-[13px] text-[#6e6a60]">
                    序言 · 由社区共同维护
                </p>
            </div>
        </div>
    )
}
