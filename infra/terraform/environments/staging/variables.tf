variable "vpc_id" {
  type        = string
  description = "Pre-existing VPC id - VPC creation itself is out of scope for this module (owned by a separate network-foundation stack)."
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "db_master_password" {
  type      = string
  sensitive = true
}
