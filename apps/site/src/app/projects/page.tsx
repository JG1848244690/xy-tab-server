import type { Metadata } from 'next'
import { notesFor, projects } from '@/lib/projects'

export const metadata: Metadata = {
    title: '小工具',
    description: '序言作者的项目手记。浏览 Chrome 新标签页扩展和 pi-fish 终端阅读插件。',
    alternates: { canonical: '/projects' },
}

export default function ProjectsPage() {
    return (
        <>
            <p className="font-mono text-xs text-accent">Find some interesting tools</p>
            <h1 className="mt-3 text-[42px] leading-tight sm:text-[58px]">一些有意思的小工具</h1>
            <div className="mt-6 grid gap-4 border-y border-border py-5 sm:grid-cols-[180px_1fr]">
                <h2 className="text-xl">关于作者</h2>
                <div className="max-w-[60ch] space-y-2 text-sm leading-7 text-muted-foreground">
                    <p>我是 xy，序言的开发者。我做了一个用来整理浏览器书签的新标签页，也写了一个能在 AI 终端里接着读书的插件。这里收录项目、使用说明，以及实现过程中值得记下来的细节。</p>
                    <a href="https://github.com/JG1848244690" className="text-accent underline underline-offset-4">作者 GitHub <span aria-hidden="true">↗</span></a>
                </div>
            </div>
            <div className="mt-10 space-y-10">
                {projects.map((project) => (
                    <article key={project.id} className="grid gap-6 border-b border-border pb-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:items-start">
                        <a href={project.href} aria-label={`打开${project.title}介绍页`} className="block overflow-hidden border border-border bg-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                            <img src={project.image} alt={project.alt} width={720} height={405} loading={project.id === 'newtab' ? 'eager' : 'lazy'}
                                fetchPriority={project.id === 'newtab' ? 'high' : undefined} className="aspect-video w-full object-cover" />
                        </a>
                        <div>
                            <p className="text-xs text-muted-foreground">{project.type}</p>
                            <h2 className="mt-1 text-3xl">{project.title}</h2>
                            <p className="mt-2 text-sm leading-7 text-muted-foreground">{project.description}</p>
                            <a href={project.href} className="mt-3 inline-flex border border-seal px-3 py-2 text-sm text-seal hover:bg-seal hover:text-white">查看介绍与教程 <span aria-hidden="true" className="ml-2">↗</span></a>
                            <ul className="mt-5 divide-y divide-border border-y border-border text-sm">
                                {notesFor(project.id).map((note) => <li key={note.slug}><a href={`/projects/notes/${note.slug}`} className="block py-2.5 text-accent hover:underline">{note.title}</a></li>)}
                            </ul>
                        </div>
                    </article>
                ))}
            </div>
        </>
    )
}
