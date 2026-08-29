output "bootstrap_brokers" {
  description = "Plaintext bootstrap string - what KAFKA_BROKERS in each overlay's common-config patch should resolve to."
  value       = aws_msk_cluster.this.bootstrap_brokers
}

output "bootstrap_brokers_tls" {
  value = aws_msk_cluster.this.bootstrap_brokers_tls
}

output "zookeeper_connect_string" {
  description = "Present for older client-library compatibility only - KafkaJS (used by every service here) talks to brokers directly and never needs this."
  value       = aws_msk_cluster.this.zookeeper_connect_string
}
