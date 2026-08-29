output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "rds_endpoints" {
  value = module.rds.endpoints
}

output "kafka_bootstrap_brokers" {
  value = module.msk.bootstrap_brokers
}
