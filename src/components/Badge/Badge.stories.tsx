import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from 'lucide-react'
import { Badge } from './Badge'

const tones = ['measure', 'dark', 'closed', 'success', 'info', 'danger', 'warning', 'neutral'] as const

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    tone: { control: 'select', options: tones },
    size: { control: 'select', options: ['sm', 'md'] },
  },
  args: {
    children: '지금 입양할 수 있어요',
    tone: 'success',
    size: 'md',
  },
}

export default meta
type Story = StoryObj<typeof Badge>

export const Playground: Story = {}

export const AllTones: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-2">
      {tones.map((tone) => (
        <Badge key={tone} tone={tone}>
          {tone}
        </Badge>
      ))}
    </div>
  ),
}

export const ArBadge: Story = {
  render: () => (
    <Badge tone="measure" size="sm">
      <Box className="size-3" strokeWidth={2.4} aria-hidden />
      AR로 보기
    </Badge>
  ),
}

export const NoticeNumber: Story = {
  args: { tone: 'neutral', className: 'font-mono', children: '경기-화성-2026-01509' },
}
