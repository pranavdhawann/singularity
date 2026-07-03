# Permissions and Privacy

Future should be local first and permission explicit. Privacy is a baseline
trust requirement, not a vague marketing claim.

## Privacy Position

Do not promise perfect PII removal. Promise:

- local storage by default
- inspectable prompts
- configurable redaction
- local secret storage
- source-backed memory
- user control over what leaves the machine

## Permission Model

Permissions are detailed toggles. Each capability should have a state:

- deny
- ask every time
- allow for session
- allow for workspace
- always allow

## Core Permissions

- Read files
- Write files
- Run commands
- Browse web
- Call APIs
- Access contacts
- Call people
- Access vault
- Write memory
- Use external models
- Install or connect tools
- Run background tasks

## Permission Request UX

When the assistant needs permission, it should explain:

- what it wants to do
- why it needs the permission
- what data will be accessed
- what data may leave the machine
- which model or tool will be used
- whether the grant is temporary or persistent

## PII and Secret Handling

Sensitive data classes:

- passwords
- API keys
- auth tokens
- private keys
- phone numbers
- email addresses
- home addresses
- government IDs
- financial data
- medical data
- private contacts
- personal notes

V1 should support:

- local detection before external model calls
- configurable redaction rules
- prompt preview
- source labels
- local vault for secrets
- placeholder replacement when needed

## Local Vault

Secrets should not be stored in vector databases or plain memory records.

Use OS-backed secure storage where possible:

- macOS Keychain
- Windows Credential Manager
- Linux Secret Service or supported keyring

The assistant can retrieve secrets only through explicit permission.

## Honesty and Limits

The assistant should state when:

- it lacks required permission
- it lacks enough context
- memory is uncertain
- a source is missing
- a tool failed
- it cannot safely complete a request
- the user needs to choose between options

This is a product feature. Trust comes from clear limits.

## Audit Trail

Every sensitive action should create a timeline event:

- permission requested
- permission granted or denied
- data accessed
- model used
- tool called
- result
- errors
