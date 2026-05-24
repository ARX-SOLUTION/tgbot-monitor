# Operations Center V1

## Overview

The Operations Center is the Telegram operator console for the monitoring dashboard. It supports:
- known chat discovery from incoming updates
- direct sends and replies
- reusable media registration via Telegram `file_id`
- broadcast preview and execution
- group/channel admin actions
- permission scanning for bots in a selected chat
- audit logging for outbound and admin operations

## Known Chats

Known chats are collected from incoming Telegram updates. A bot can only message a chat or user after the chat has already interacted with that bot.

### Important rules
- Private messages are only possible if the user has interacted with the bot.
- Group/channel actions require the bot to be a member and, for admin actions, to have the corresponding rights.
- Blocked or unreachable chats are skipped during broadcasts.

## Send / Reply

Use the `Send` tab to target a chat by ID or username. The composer supports:
- text messages
- photo, video, animation, audio, voice, document, sticker sends
- `mediaFileId` reuse for Telegram files
- media URLs as a fallback
- replies to an existing message ID

## Media File ID Reuse

The `Media` tab lets operators register reusable Telegram media assets.
- Required: bot selector, file type, and `file_id`
- Optional: `file_unique_id`, name, MIME type, file size, title
- Registered assets can be loaded into the send composer with `Use in composer`

## Permission Scanner

The `Inbox` tab now supports selecting a known chat and scanning the bot's permissions.
- Displays badges for `canSendMessages`, `canSendMedia`, `canDeleteMessages`, `canPinMessages`, `canInviteUsers`, `canRestrictMembers`, `canPromoteMembers`, `canChangeInfo`
- Warns that Telegram permissions depend on bot admin rights in the selected chat

## Broadcast Preview and Safety

The `Broadcasts` tab includes target preview before creation.
- Preview shows `totalTargets`, `sampleTargets`, `excludedBlocked`, and `excludedCannotSend`
- Explicit confirmation is required before creating the broadcast
- Broadcast jobs only target known reachable chats and skip blocked/unreachable ones

## Group / Channel Admin Safety

The `Groups` tab now requires confirmation for dangerous actions:
- `banChatMember`
- `restrictChatMember`
- `promoteChatMember`
- `deleteMessage`
- `setChatTitle`
- `setChatDescription`
- `createChatInviteLink`

Dangerous actions also require an operator reason of at least 8 characters.

## Audit Logs

All outbound operations, broadcast lifecycle actions, and admin actions are recorded in audit logs with:
- bot ID
- action type
- target chat/user
- payload and result JSON
- status and error message
- timestamp

## Follow-up Tasks

- Add RBAC for operator access to the Operations Center
- Add a dedicated inbox/message selection panel
- Add chat segmentation and broadcast filtering by tags
- Add background worker retry policies for large broadcasts
