import type { Metadata } from 'next'
import { wallpaperGuides, wallpaperGuidePath } from '@/lib/wallpaper-guides'

const title = 'Live Wallpaper Chrome Extension for Your New Tab'
const description = 'Use a compatible Wallpaper Engine Scene as a live Chrome new tab background. Check supported files, import a scene.pkg, and keep your bookmarks in a dock or groups.'
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
                <nav aria-label="On this page" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-accent">
                    <a href="#compatibility" className="hover:underline">Supported files</a>
                    <a href="#setup" className="hover:underline">Setup</a>
                    <a href="#troubleshooting" className="hover:underline">Troubleshooting</a>
                </nav>
            </header>

            <figure>
                <img src="https://static.kskbl.com.cn/newtab/assets/dock.jpg" alt="Chrome new tab with an animated mountain scene and a bookmark dock" width={1280} height={800} className="h-auto w-full border border-border" />
                <figcaption className="mt-2 text-sm text-muted-foreground">A wallpaper behind the search box and bookmark dock.</figcaption>
            </figure>

            <section id="compatibility" className="scroll-mt-20 space-y-3">
                <h2 className="text-2xl">Check the wallpaper type before you install</h2>
                <p className="leading-7">Open the wallpaper in Wallpaper Engine and look at the type beneath its preview. A downloaded <strong>Scene</strong> with a <code>scene.pkg</code> file is the one to try here. A Steam Workshop link points to the listing, so open its downloaded folder to get the files.</p>
                <dl className="divide-y divide-border border-y border-border text-sm leading-6">
                    <div className="grid gap-1 py-3 sm:grid-cols-[170px_1fr]"><dt className="font-medium">Scene · <code>scene.pkg</code></dt><dd>Import the package or its folder. Keep <code>project.json</code> alongside it when available. Rendering support depends on what the scene uses.</dd></div>
                    <div className="grid gap-1 py-3 sm:grid-cols-[170px_1fr]"><dt className="font-medium">Video · <code>.mp4</code></dt><dd>A video file belongs to a different wallpaper type. The Scene importer expects a Scene package.</dd></div>
                    <div className="grid gap-1 py-3 sm:grid-cols-[170px_1fr]"><dt className="font-medium">Web · HTML</dt><dd>Web wallpapers and system audio effects are currently unsupported. Mouse effects work with some Scenes, depending on the wallpaper and extension build.</dd></div>
                </dl>
            </section>

            <section id="setup" className="scroll-mt-20 space-y-4">
                <h2 className="text-2xl">Set up your first live wallpaper</h2>
                <ol className="list-decimal space-y-2 pl-6 leading-7">
                    <li>Install NewTab by Xuyan and press <kbd>Ctrl+T</kbd>. If Chrome asks whether to keep the new tab changes, choose to keep them.</li>
                    <li>In Wallpaper Engine, right-click an installed Scene and choose <strong>Open in Explorer</strong>.</li>
                    <li>Back in the new tab, open <strong>Settings → Scene wallpaper</strong> and choose the folder or its <code>scene.pkg</code>.</li>
                    <li>Use <strong>Contain</strong> to show the whole scene, or <strong>Cover</strong> to fill the tab and crop the edges as needed. Lower the opacity if a bright background makes bookmarks harder to read.</li>
                </ol>
                <figure>
                    <img src="https://static.kskbl.com.cn/newtab/assets/scene.jpg" alt="Scene wallpaper settings showing folder and scene.pkg import controls" width={1280} height={800} loading="lazy" className="h-auto w-full border border-border" />
                    <figcaption className="mt-2 text-sm text-muted-foreground">The Scene wallpaper panel accepts a local folder or a package file.</figcaption>
                </figure>
                <p className="leading-7">After import, the extension keeps the Scene files in the browser’s local storage. Opening another new tab reuses the saved Scene, so you don’t have to pick the folder again.</p>
            </section>

            <section id="troubleshooting" className="scroll-mt-20 space-y-3">
                <h2 className="text-2xl">If you see a blank background or missing effects</h2>
                <p className="leading-7"><strong>Start with one simple Scene.</strong> Pick a wallpaper with a picture and a small animation. If it loads but your preferred wallpaper doesn’t, check whether the second Scene uses effects or assets the browser renderer handles differently.</p>
                <p className="leading-7"><strong>Check that you picked one wallpaper’s folder.</strong> A Steam Workshop library can contain many Scenes. In Wallpaper Engine, use the right-click menu on the exact item you want, then select the folder it opens.</p>
                <p className="leading-7"><strong>Test the right kind of interaction.</strong> A scene that moves on its own may have no mouse effect. If it reacts on the desktop but stays still when you move the pointer in Chrome, the scene or extension build may handle that effect differently.</p>
            </section>

            <section className="space-y-3">
                <h2 className="text-2xl">Bring your bookmarks along</h2>
                <p className="leading-7">Open <strong>Import &amp; Export</strong> in the top right to choose which Chrome bookmarks to bring in. Use Dock for a row of frequently opened sites, or switch to Groups to keep work, reading, and personal links apart. The layout control lives in the top right and in Settings.</p>
                <p className="text-sm leading-6 text-muted-foreground">NewTab is maintained by <a href="https://github.com/JG1848244690" className="text-accent hover:underline">xy</a>. The <a href="/projects/notes/wallpaper-engine-scene" className="text-accent hover:underline">Scene rendering note in Chinese</a> explains how the browser draws the imported package.</p>
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
