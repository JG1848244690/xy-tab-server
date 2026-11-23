import { generateWallpaperGuideParams, wallpaperGuideMetadata, WallpaperGuide, type WallpaperGuideProps } from '@/components/wallpaper-guide'

export const dynamicParams = false

export function generateStaticParams() {
    return generateWallpaperGuideParams()
}

export function generateMetadata(props: WallpaperGuideProps) {
    return wallpaperGuideMetadata(props, 'en')
}

export default function WallpaperGuidePage(props: WallpaperGuideProps) {
    return <WallpaperGuide {...props} language="en" />
}
