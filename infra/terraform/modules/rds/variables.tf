variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Subnets for the DB subnet group - RDS instances never sit in a public subnet."
}

variable "allowed_security_group_id" {
  description = "Typically the EKS node group's security group (or an equivalent) - the only source allowed to reach these databases."
  type        = string
}

variable "instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "allocated_storage_gb" {
  type    = number
  default = 50
}

variable "engine_version" {
  type    = string
  default = "16.3"
}

variable "master_password" {
  description = "Set via a secure variable source (TF Cloud workspace var, or -var-file kept out of Git) - never a literal in any .tf file."
  type        = string
  sensitive   = true
}

variable "service_names" {
  description = "One RDS instance is provisioned per name here - this is the production realization of the Database-per-Service pattern the local docker-compose stack fakes with schemas inside one shared Postgres instance."
  type        = list(string)
  default     = ["order-service", "payment-service", "inventory-service", "saga-orchestrator", "audit-ledger-service"]
}
