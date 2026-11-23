import type { Metadata } from 'next'
import { wallpaperGuides, wallpaperGuidePath } from '@/lib/wallpaper-guides'

const title = 'Live Wallpaper Chrome Extension for Your New Tab'
const description = 'Set a compatible Wallpaper Engine Scene as your Chrome new tab background. Import your local scene.pkg and keep your bookmarks in a dock or groups.'
const storeUrl = 'https://chromewebstore.google.com/detail/lanccjojcmdklbhnbmbfemiabnpbgoga'
const guideUrl = 'https://static.kskbl.com.cn/newtab/'

export const metadata: Metadata = {
    title: { absolute: `${title} | NewTab by Xuyan` },
    description,
    alternates: { canonical: '/en/projects/newtab' },
    openGraph: { title, description, url: '/en/projects/newtab', locale: 'en_US' },
}

export default function EnglishNewTabPage() {
    return (
        <article lang="en" className="mx-auto max-w-[760px] space-y-8">
            <header className="space-y-4">
                <p className="font-mono text-xs text-muted-foreground">NewTab by Xuyan</p>
                <h1 className="text-balance text-4xl leading-tight sm:text-5xl">{title}</h1>
                <p className="max-w-[62ch] leading-7 text-muted-foreground">{description}</p>
                <div className="flex flex-wrap gap-4 text-sm">
                    <a href={storeUrl} className="border border-seal px-3 py-2 text-seal hover:bg-seal hover:text-white">Install from the Chrome Web Store</a>
                    <a href={guideUrl} className="px-3 py-2 text-accent hover:underline">Read the user guide</a>
                </div>
            </header>

            <figure>
                <img src="https://static.kskbl.com.cn/newtab/assets/dock.jpg" alt="Chrome new tab with an animated mountain scene and a bookmark dock" width={1280} height={800} className="h-auto w-full border border-border" />
                <figcaption className="mt-2 text-sm text-muted-foreground">A wallpaper behind the search box and bookmark dock.</figcaption>
            </figure>

            <section className="space-y-3">
                <h2 className="text-2xl">Use a Scene you already downloaded</h2>
                <p className="leading-7">In Wallpaper Engine, open the wallpaper’s local folder. Then open a Chrome new tab and go to <strong>Settings → Scene wallpaper</strong>. Select the folder or its <code>scene.pkg</code>. Your imported files stay in the browser’s local storage.</p>
                <p className="leading-7">Scene compatibility varies by effect and asset. Some Scenes retain their mouse effects. Web and HTML wallpapers and system audio reactivity are currently outside the Scene importer’s support.</p>
            </section>

            <nav aria-label="Wallpaper Engine guides" className="space-y-3 border-t border-border pt-5">
                <h2 className="text-2xl">Wallpaper Engine guides</h2>
                <ul className="space-y-2 text-accent">
                    {wallpaperGuides.map((guide) => (
                        <li key={guide.slug}>
                            <a href={wallpaperGuidePath(guide.slug, 'en')} className="hover:underline">{guide.en.title}</a>
                        </li>
                    ))}
                </ul>
                <a href="https://static.kskbl.com.cn/newtab/zh.html" lang="zh-CN" className="text-sm text-accent hover:underline">简体中文使用手册</a>
            </nav>
        </article>
    )
}
