output "cluster_name" {
  value = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  value = aws_eks_cluster.this.endpoint
}

output "cluster_certificate_authority_data" {
  value = aws_eks_cluster.this.certificate_authority[0].data
}

output "node_role_arn" {
  description = "Consumed by the RDS/MSK modules' security groups to authorize traffic FROM the EKS node group."
  value       = aws_iam_role.node_group.arn
}

output "cluster_security_group_id" {
  description = "EKS's auto-managed cluster security group, attached to both the control plane and worker nodes - this is the correct id to allow-list in RDS/MSK security groups, not anything derived from node_role_arn."
  value       = aws_eks_cluster.this.vpc_config[0].cluster_security_group_id
}
