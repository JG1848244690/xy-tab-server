import { useEffect, useRef, useState } from 'react'
import { Video } from 'lucide-react'

interface Auth3DCardProps {
  title?: string
  description?: string
}

export function Auth3DCard({
  title = 'Athena 学习平台',
  description = '探索知识的海洋，开启学习新旅程',
}: Auth3DCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const centerX = rect.width / 2
      const centerY = rect.height / 2

      const rotateXValue = ((y - centerY) / centerY) * -10
      const rotateYValue = ((x - centerX) / centerX) * 10

      setRotateX(rotateXValue)
      setRotateY(rotateYValue)
    }

    const handleMouseLeave = () => {
      setRotateX(0)
      setRotateY(0)
    }

    card.addEventListener('mousemove', handleMouseMove)
    card.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      card.removeEventListener('mousemove', handleMouseMove)
      card.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <div
      ref={cardRef}
      className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden"
      style={{
        perspective: '1000px',
      }}
    >
      <div
        className="w-full h-full relative transition-transform duration-200 ease-out"
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* 背景渐变 */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/70" />

        {/* 装饰性网格 */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(to right, white 1px, transparent 1px),
              linear-gradient(to bottom, white 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        {/* 浮动圆形装饰 */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse delay-1000" />

        {/* 内容区域 */}
        <div className="relative h-full flex flex-col items-center justify-center p-12 text-white z-10">
          <div
            className="mb-8 p-6 bg-white/10 backdrop-blur-sm rounded-3xl shadow-2xl"
            style={{
              transform: 'translateZ(50px)',
            }}
          >
            <Video className="w-20 h-20" strokeWidth={1.5} />
          </div>

          <h1
            className="text-5xl font-bold mb-6 text-center"
            style={{
              transform: 'translateZ(40px)',
              textShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}
          >
            {title}
          </h1>

          <p
            className="text-xl text-white/90 text-center max-w-md leading-relaxed"
            style={{
              transform: 'translateZ(30px)',
              textShadow: '0 2px 10px rgba(0,0,0,0.1)',
            }}
          >
            {description}
          </p>

          {/* 装饰性元素 */}
          <div className="mt-12 flex gap-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full bg-white/40"
                style={{
                  transform: `translateZ(${20 + i * 5}px)`,
                  animation: `pulse 2s ease-in-out ${i * 0.3}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
