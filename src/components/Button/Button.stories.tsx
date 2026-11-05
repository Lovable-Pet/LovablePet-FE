import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './Button'

const variants = [
  'primary',
  'dark',
  'soft',
  'outline',
  'outline-strong',
  'outline-subtle',
  'measure',
  'accent-soft',
  'kakao',
] as const

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: variants },
    size: { control: 'select', options: ['xl', 'lg', 'md', 'sm', 'field'] },
  },
  args: {
    children: '우리 집에 놓아 보기',
    variant: 'primary',
    size: 'lg',
    disabled: false,
  },
}

export default meta
type Story = StoryObj<typeof Button>

export const Playground: Story = {}

export const AllVariants: Story = {
  render: () => (
    <div className="flex w-[350px] flex-col gap-3">
      {variants.map((variant) => (
        <Button key={variant} variant={variant} fullWidth>
          {variant}
        </Button>
      ))}
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="xl">xl 56</Button>
      <Button size="lg">lg 52</Button>
      <Button size="md" variant="outline">
        md 48
      </Button>
      <Button size="sm" variant="outline">
        sm 44
      </Button>
    </div>
  ),
}

export const Disabled: Story = {
  args: { disabled: true },
}
