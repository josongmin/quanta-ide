# @quanta/app-agent

AI agent chat tab application with session management and source-context panel.

## Responsibility

- Render the agent chat interface with message history and input
- Manage agent session sidebar (session list, create/switch)
- Display source-context panel alongside chat for code-aware conversations

## Dependencies

- `@quanta/shell-contract` -- `TabAppProps` for tab integration
- `@quanta/shell` -- tab bus
- `@quanta/ui-kit` -- `cn` utility

## Public API

- `agentAppDescriptor` -- `TabAppDescriptor` for shell registration
- `AgentApp` -- root component

## Architecture notes

Self-contained app. AgentPage owns its own chat state and session management internally -- no additional shell context bridging required. Entities layer holds agent session and message models.
