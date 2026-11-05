import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '../Button/Button'
import { Field } from './Field'

const meta: Meta<typeof Field> = {
  title: 'Components/Field',
  component: Field,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[342px]">
        <Story />
      </div>
    ),
  ],
  args: {
    label: '아이디',
    placeholder: '영문·숫자·밑줄 4~20자',
  },
}

export default meta
type Story = StoryObj<typeof Field>

export const Playground: Story = {}

export const WithHint: Story = {
  args: { label: '이메일', type: 'email', placeholder: 'name@example.com', hint: '연락이 필요할 때만 써요.' },
}

export const ErrorState: Story = {
  args: { label: '비밀번호', type: 'password', defaultValue: 'secret', error: '아이디 또는 비밀번호가 맞지 않아요.' },
}

export const WithTrailingButton: Story = {
  args: {
    defaultValue: 'lovable_01',
    success: '사용할 수 있는 아이디예요.',
    trailing: (
      <Button variant="outline-strong" size="field">
        중복 확인
      </Button>
    ),
  },
}
