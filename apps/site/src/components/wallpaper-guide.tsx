import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Markdown } from '@/lib/markdown'
import { projects } from '@/lib/projects'
import { wallpaperGuides, wallpaperGuidePath, type GuideLanguage } from '@/lib/wallpaper-guides'

const englishGuide = 'https://static.kskbl.com.cn/newtab/'

export type WallpaperGuideProps = { params: Promise<{ slug: string }> }

export function generateWallpaperGuideParams() {
    return wallpaperGuides.map(({ slug }) => ({ slug }))
}

export async function wallpaperGuideMetadata({ params }: WallpaperGuideProps, language: GuideLanguage): Promise<Metadata> {
    const { slug } = await params
    const guide = wallpaperGuides.find((entry) => entry.slug === slug)
    if (!guide) return {}
    return {
        title: guide[language].title,
        description: guide[language].summary,
        alternates: {
            canonical: wallpaperGuidePath(slug, language),
            languages: {
                'zh-CN': wallpaperGuidePath(slug, 'zh'),
                en: wallpaperGuidePath(slug, 'en'),
            },
        },
    }
}

export async function WallpaperGuide({ params, language }: WallpaperGuideProps & { language: GuideLanguage }) {
    const { slug } = await params
    const guide = wallpaperGuides.find((entry) => entry.slug === slug)
    if (!guide) notFound()
    const { title, body } = guide[language]
    const english = language === 'en'

    return (
        <article lang={english ? 'en' : 'zh-CN'} className="mx-auto max-w-[760px]">
            <nav aria-label={english ? 'Page links' : '页面导航'} className="flex flex-wrap justify-between gap-4 text-sm text-accent">
                <a href="/projects" lang="zh-CN" className="hover:underline">← 小工具</a>
                <a href={wallpaperGuidePath(slug, english ? 'zh' : 'en')} lang={english ? 'zh-CN' : 'en'} className="hover:underline">
                    {english ? '简体中文' : 'English'}
                </a>
            </nav>
            <header className="mt-5 border-b border-border pb-5">
                <p className="font-mono text-xs text-muted-foreground">{english ? 'NewTab by Xuyan' : '序言新标签页'}</p>
                <h1 className="mt-3 text-balance text-4xl leading-tight sm:text-5xl">{title}</h1>
            </header>
            <div className="prose prose-sm mt-6 max-w-none sm:prose-base dark:prose-invert"><Markdown>{body}</Markdown></div>
            <nav aria-label={english ? 'Related guides' : '相关文章'} className="mt-8 border-t border-border pt-4 text-sm text-accent">
                <ul className="space-y-2">
                    {wallpaperGuides.filter((entry) => entry.slug !== slug).map((entry) => (
                        <li key={entry.slug}><a href={wallpaperGuidePath(entry.slug, language)} className="hover:underline">{entry[language].title}</a></li>
                    ))}
                    <li><a href={english ? englishGuide : projects[0].href} className="hover:underline">
                        {english ? 'NewTab by Xuyan user guide' : '序言新标签页介绍与使用手册'} ↗
                    </a></li>
                </ul>
            </nav>
        </article>
    )
}
