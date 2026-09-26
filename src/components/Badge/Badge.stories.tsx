import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from './Badge'

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: 'select',
      options: ['primary', 'rose', 'success', 'warning', 'neutral', 'info', 'violet'],
    },
    variant: { control: 'select', options: ['filled', 'outlined'] },
    size: { control: 'select', options: ['lg', 'md', 'sm'] },
  },
  args: {
    children: 'BADGE',
    color: 'primary',
    variant: 'filled',
    size: 'md',
  },
}

export default meta
type Story = StoryObj<typeof Badge>

export const Playground: Story = {}

export const AllColors: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(['primary', 'rose', 'success', 'warning', 'neutral', 'info', 'violet'] as const).map(
        (color) => (
          <div key={color} className="flex items-center gap-2">
            <Badge color={color} variant="filled">
              BADGE
            </Badge>
            <Badge color={color} variant="outlined">
              BADGE
            </Badge>
          </div>
        ),
      )}
    </div>
  ),
}
