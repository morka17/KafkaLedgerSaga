variable "environment" {
  description = "Environment name (staging, production) - used in resource naming and tags."
  type        = string
}

variable "vpc_id" {
  description = "VPC to launch the EKS cluster into."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnets for worker nodes - the cluster's data plane never sits in a public subnet."
  type        = list(string)
}

variable "cluster_version" {
  description = "Kubernetes version for the EKS control plane."
  type        = string
  default     = "1.29"
}

variable "node_instance_types" {
  description = "Instance types for the managed node group."
  type        = list(string)
  default     = ["m6i.large"]
}

variable "node_min_size" {
  type    = number
  default = 2
}

variable "node_max_size" {
  type    = number
  default = 10
}

variable "node_desired_size" {
  type    = number
  default = 3
}
