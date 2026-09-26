import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Chip } from './Chip'

const meta: Meta<typeof Chip> = {
  title: 'Components/Chip',
  component: Chip,
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
    children: 'CHIP',
    color: 'primary',
    variant: 'filled',
    size: 'md',
  },
}

export default meta
type Story = StoryObj<typeof Chip>

export const Playground: Story = {}

export const Dismissible: Story = {
  args: { onDismiss: () => alert('dismissed') },
}

export const SelectableGroup: Story = {
  render: () => {
    const options = ['아파트', '단독주택', '원룸/빌라']
    const [selected, setSelected] = useState(options[0])
    return (
      <div className="flex gap-2">
        {options.map((option) => (
          <Chip
            key={option}
            size="md"
            selected={selected === option}
            onClick={() => setSelected(option)}
          >
            {option}
          </Chip>
        ))}
      </div>
    )
  },
}
