import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Markdown } from '@/lib/markdown'
import { notesFor, projectNotes, projects } from '@/lib/projects'

type Props = { params: Promise<{ slug: string }> }
export const dynamicParams = false

export function generateStaticParams() {
    return projectNotes.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const note = projectNotes.find((entry) => entry.slug === slug)
    return note ? { title: note.title, description: note.summary, alternates: { canonical: `/projects/notes/${slug}` } } : {}
}

export default async function ProjectNotePage({ params }: Props) {
    const { slug } = await params
    const note = projectNotes.find((entry) => entry.slug === slug)
    if (!note) notFound()
    const project = projects.find((entry) => entry.id === note.project)

    return (
        <article className="mx-auto max-w-[760px]">
            <a href="/projects" className="text-sm text-accent hover:underline">← 小工具</a>
            <header className="mt-5 border-b border-border pb-5">
                <p className="font-mono text-xs text-muted-foreground">{project?.title} · 开发手记</p>
                <h1 className="mt-3 text-balance text-4xl leading-tight sm:text-5xl">{note.title}</h1>
                <p className="mt-3 text-base leading-7 text-muted-foreground">{note.summary}</p>
            </header>
            <div className="prose prose-sm mt-6 max-w-none sm:prose-base dark:prose-invert"><Markdown>{note.body}</Markdown></div>
            <nav aria-label="继续阅读" className="mt-8 flex flex-wrap gap-4 border-t border-border pt-4 text-sm text-accent">
                {notesFor(note.project).filter((entry) => entry.slug !== slug).map((entry) => <a key={entry.slug} href={`/projects/notes/${entry.slug}`} className="hover:underline">{entry.title} →</a>)}
                {project && <a href={project.href} className="hover:underline">打开产品手册 ↗</a>}
            </nav>
        </article>
    )
}
