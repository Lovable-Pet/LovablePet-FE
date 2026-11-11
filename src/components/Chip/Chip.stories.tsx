import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from 'lucide-react'
import { Chip } from './Chip'

const meta: Meta<typeof Chip> = {
  title: 'Components/Chip',
  component: Chip,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['filter', 'accent'] },
    size: { control: 'select', options: ['md', 'sm'] },
  },
  args: {
    children: '경기도',
    variant: 'filter',
    size: 'md',
    selected: false,
  },
}

export default meta
type Story = StoryObj<typeof Chip>

export const Playground: Story = {}

export const WithCount: Story = {
  args: { count: 412 },
}

function RegionGroup() {
  const regions: [string, number][] = [
    ['경기도', 412],
    ['경상남도', 236],
    ['충청남도', 188],
  ]
  const [selected, setSelected] = useState('경기도')
  return (
    <div className="flex flex-wrap gap-2">
      {regions.map(([name, count]) => (
        <Chip
          key={name}
          count={count}
          selected={selected === name}
          onClick={() => setSelected((prev) => (prev === name ? '' : name))}
        >
          {name}
        </Chip>
      ))}
    </div>
  )
}

export const SelectableGroup: Story = {
  render: () => <RegionGroup />,
}

function ArToggle() {
  const [on, setOn] = useState(true)
  return (
    <Chip variant="accent" selected={on} onClick={() => setOn((prev) => !prev)}>
      <Box className="size-4" aria-hidden />
      AR로 볼 수 있는 유기견
    </Chip>
  )
}

export const AccentToggle: Story = {
  render: () => <ArToggle />,
}

export const Small: Story = {
  args: { size: 'sm', children: '중형 · 10~25kg' },
}
