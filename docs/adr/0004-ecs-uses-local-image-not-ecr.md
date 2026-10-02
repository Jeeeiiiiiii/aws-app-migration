# ECS runs the locally built image; ECR is skipped

Floci's ECR can't accept pushes or list images reliably (its backing registry isn't
reachable from the emulator, and the advertised registry host needs insecure-registry
and hosts-file changes). Because Floci starts ECS tasks on the same Docker daemon, the
task definition references the locally built image directly. The console and docs
state that in real AWS this step is an ECR push.
