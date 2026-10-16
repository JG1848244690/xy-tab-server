import React from 'react'
import Drawer from '@/components/drawer'
import { MobileGate } from '@/components/mobile-gate'
const Index = () => {
  return (
    <MobileGate>
      <div className="w-full h-full min-w-0">
        <Drawer />
      </div>
    </MobileGate>
  )
}

export default Index
