# Dev does NOT provision EKS/RDS/MSK - it uses the local docker-compose
# stack (docker-compose.yml at repo root) entirely. This file exists so
# the directory structure is symmetric with staging/production, and as
# the natural place to add a genuinely cloud-hosted "dev" environment
# later (e.g. a shared team sandbox) without restructuring anything.

terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Intentionally no resources yet - see comment above.
