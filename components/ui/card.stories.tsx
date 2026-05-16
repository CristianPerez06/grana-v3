import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card'
import { Button } from './button'

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div className="w-96">{Story()}</div>],
}
export default meta

type Story = StoryObj<typeof Card>

export const Default: Story = {
  render: () => (
    <Card>
      <CardContent className="pt-6">
        A plain card with no header or footer.
      </CardContent>
    </Card>
  ),
}

export const FullComposition: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Log in to your account to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This is the content area of the card.
        </p>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost">Cancel</Button>
        <Button>Continue</Button>
      </CardFooter>
    </Card>
  ),
}
