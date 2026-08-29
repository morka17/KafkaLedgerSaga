output "endpoints" {
  description = "Map of service name -> RDS connection endpoint, for wiring into each service's DB_HOST via ExternalSecret/ConfigMap."
  value       = { for name, db in aws_db_instance.service : name => db.address }
}

output "security_group_id" {
  value = aws_security_group.rds.id
}
