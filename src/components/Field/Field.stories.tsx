import type { Meta, StoryObj } from '@storybook/react-vite'
import { Field } from './Field'

const meta: Meta<typeof Field> = {
  title: 'Components/Field',
  component: Field,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['lg', 'md', 'sm'] },
  },
  args: {
    label: 'Label',
    placeholder: 'Placeholder',
    size: 'md',
  },
}

export default meta
type Story = StoryObj<typeof Field>

export const Playground: Story = {}

export const Required: Story = {
  args: { required: true },
}

export const Filled: Story = {
  args: { filled: true, defaultValue: 'Filled content' },
}

export const ErrorState: Story = {
  args: { required: true, error: '올바른 형식이 아닙니다', defaultValue: 'Invalid Input' },
}

export const NoLabel: Story = {
  args: { label: undefined },
}
