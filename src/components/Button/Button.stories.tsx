import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    color: { control: 'select', options: ['primary', 'secondary', 'neutral', 'danger'] },
    variant: { control: 'select', options: ['solid', 'outline', 'ghost'] },
    size: { control: 'select', options: ['lg', 'md', 'sm'] },
  },
  args: {
    children: 'BUTTON',
    color: 'primary',
    variant: 'solid',
    size: 'md',
    disabled: false,
  },
}

export default meta
type Story = StoryObj<typeof Button>

export const Playground: Story = {}

export const AllColors: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(['primary', 'secondary', 'neutral', 'danger'] as const).map((color) => (
        <div key={color} className="flex items-center gap-2">
          <Button color={color} variant="solid">
            BUTTON
          </Button>
          <Button color={color} variant="outline">
            BUTTON
          </Button>
          <Button color={color} variant="ghost">
            BUTTON
          </Button>
        </div>
      ))}
    </div>
  ),
}

export const Disabled: Story = {
  args: { disabled: true },
}
