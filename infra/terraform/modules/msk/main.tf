# Managed Kafka for staging/production - replaces the in-cluster
# Kafka/Zookeeper StatefulSets dev uses (infra/k8s/base/local-kafka).
# Topic creation itself is NOT done here - see infra/kafka-topics/topics.yaml,
# applied via a separate topic-management step (a Kafka admin client run
# in CI, or a GitOps operator) once the cluster is up.

resource "aws_security_group" "msk" {
  name        = "saganova-${var.environment}-msk"
  description = "Allows Kafka broker traffic only from the EKS node group."
  vpc_id      = var.vpc_id

  ingress {
    description     = "Plaintext broker traffic from EKS nodes"
    from_port       = 9092
    to_port         = 9092
    protocol        = "tcp"
    security_groups = [var.allowed_security_group_id]
  }

  ingress {
    description     = "TLS broker traffic from EKS nodes"
    from_port       = 9094
    to_port         = 9094
    protocol        = "tcp"
    security_groups = [var.allowed_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Environment = var.environment
    Project     = "saganova"
  }
}

resource "aws_msk_configuration" "this" {
  name              = "saganova-${var.environment}"
  kafka_versions    = [var.kafka_version]
  server_properties = <<PROPERTIES
auto.create.topics.enable=false
default.replication.factor=3
min.insync.replicas=2
num.partitions=6
PROPERTIES
}

resource "aws_msk_cluster" "this" {
  cluster_name           = "saganova-${var.environment}"
  kafka_version          = var.kafka_version
  number_of_broker_nodes = var.broker_count

  broker_node_group_info {
    instance_type   = var.broker_instance_type
    client_subnets  = var.private_subnet_ids
    security_groups = [aws_security_group.msk.id]

    storage_info {
      ebs_storage_info {
        volume_size = var.broker_volume_size_gb
      }
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.this.arn
    revision = aws_msk_configuration.this.latest_revision
  }

  encryption_info {
    encryption_in_transit {
      client_broker = "TLS_PLAINTEXT" # allows a staged migration to TLS-only without a hard cutover
      in_cluster    = true
    }
  }

  enhanced_monitoring = var.environment == "production" ? "PER_TOPIC_PER_PARTITION" : "DEFAULT"

  tags = {
    Environment = var.environment
    Project     = "saganova"
  }
}
