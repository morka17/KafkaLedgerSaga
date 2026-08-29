variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  description = "MSK requires at least as many subnets as brokers, spread across distinct AZs for real fault tolerance."
  type        = list(string)
}

variable "allowed_security_group_id" {
  type = string
}

variable "kafka_version" {
  type    = string
  default = "3.6.0"
}

variable "broker_instance_type" {
  type    = string
  default = "kafka.m5.large"
}

variable "broker_count" {
  description = "3 brokers is the minimum for the replicationFactor=3 / minInSyncReplicas=2 config infra/kafka-topics/topics.yaml specifies for production."
  type        = number
  default     = 3
}

variable "broker_volume_size_gb" {
  type    = number
  default = 100
}
