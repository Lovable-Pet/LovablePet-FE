import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Toggle } from './Toggle'

const meta: Meta<typeof Toggle> = {
  title: 'Components/Toggle',
  component: Toggle,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Toggle>

export const Playground: Story = {
  render: () => {
    const [checked, setChecked] = useState(false)
    return <Toggle checked={checked} onChange={setChecked} />
  },
}

export const Disabled: Story = {
  render: () => <Toggle checked disabled onChange={() => {}} />,
}
