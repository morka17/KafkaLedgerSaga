terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state - fill in the real bucket/table once bootstrapped.
  # Never use local state for anything beyond dev.
  backend "s3" {
    bucket         = "saganova-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "saganova-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = "us-east-1"
}
