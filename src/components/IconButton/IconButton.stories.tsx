import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChevronLeft, Heart, Share } from 'lucide-react'
import { IconButton } from './IconButton'

const meta: Meta<typeof IconButton> = {
  title: 'Components/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['ghost', 'floating', 'outline'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
  args: {
    'aria-label': '찜하기',
    variant: 'ghost',
    size: 'md',
    children: <Heart className="size-5.5" strokeWidth={1.8} aria-hidden />,
  },
}

export default meta
type Story = StoryObj<typeof IconButton>

export const Playground: Story = {}

export const OnPhoto: Story = {
  render: () => (
    <div className="flex w-[300px] justify-between rounded-card bg-[#E8DCCB] p-2">
      <IconButton variant="floating" aria-label="뒤로">
        <ChevronLeft className="size-5.5" aria-hidden />
      </IconButton>
      <IconButton variant="floating" aria-label="공유">
        <Share className="size-5" aria-hidden />
      </IconButton>
    </div>
  ),
}

export const Favorited: Story = {
  render: () => (
    <div className="flex gap-2">
      <IconButton variant="outline" aria-label="찜 취소" color="text-accent">
        <Heart className="size-5" fill="currentColor" aria-hidden />
      </IconButton>
      <IconButton variant="outline" size="lg" aria-label="찜 취소" color="text-accent">
        <Heart className="size-5.5" fill="currentColor" aria-hidden />
      </IconButton>
    </div>
  ),
}
