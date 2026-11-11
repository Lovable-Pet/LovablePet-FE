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

function ControlledToggle() {
  const [checked, setChecked] = useState(true)
  return <Toggle checked={checked} onChange={setChecked} aria-label="AR로 볼 수 있는 유기견만" />
}

export const Playground: Story = {
  render: () => <ControlledToggle />,
}

export const Off: Story = {
  render: () => <Toggle checked={false} onChange={() => {}} aria-label="꺼짐" />,
}

export const Disabled: Story = {
  render: () => <Toggle checked disabled onChange={() => {}} aria-label="비활성" />,
}
