import type { ModelViewerElement } from '@google/model-viewer'
import type { DetailedHTMLProps, HTMLAttributes } from 'react'

// <model-viewer> 를 JSX 에서 쓰기 위한 타입. 쓰는 속성만 적는다 (https://modelviewer.dev/docs)
interface ModelViewerAttributes extends DetailedHTMLProps<HTMLAttributes<ModelViewerElement>, ModelViewerElement> {
  src?: string
  'ios-src'?: string
  alt?: string
  ar?: boolean
  'ar-modes'?: string
  'ar-scale'?: 'auto' | 'fixed'
  'ar-placement'?: 'floor' | 'wall'
  'camera-controls'?: boolean
  'camera-orbit'?: string
  'touch-action'?: string
  'interaction-prompt'?: 'auto' | 'none'
  'shadow-intensity'?: string
  'shadow-softness'?: string
  exposure?: string
  loading?: 'auto' | 'lazy' | 'eager'
  reveal?: 'auto' | 'manual'
  autoplay?: boolean
  'animation-name'?: string
  'xr-environment'?: boolean
}

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': ModelViewerAttributes
    }
  }
}
