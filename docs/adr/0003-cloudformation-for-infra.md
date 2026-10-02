# CloudFormation, not Terraform, provisions the AWS side

Terraform is the more common industry choice, but on Floci CloudFormation was the
only IaC path proven end to end, including stack deletion, which Reset depends on
every run. Terraform's destroy failed against Floci's ECR, and its provider download
needs a workaround in sandboxed environments. A Terraform variant is a stretch goal.
