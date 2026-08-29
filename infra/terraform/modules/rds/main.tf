# One fully isolated RDS instance per stateful service - see
# service_names in variables.tf. This is the real Database-per-Service
# boundary; local dev fakes it cheaply with one Postgres instance and
# five schemas (infra/docker/postgres/init-schemas.sql) purely to avoid
# running five Postgres containers on a laptop.

resource "aws_db_subnet_group" "this" {
  name       = "saganova-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = {
    Environment = var.environment
    Project     = "saganova"
  }
}

resource "aws_security_group" "rds" {
  name        = "saganova-${var.environment}-rds"
  description = "Allows Postgres traffic only from the EKS node group - no public ingress, ever."
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
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

resource "aws_db_instance" "service" {
  for_each = toset(var.service_names)

  identifier     = "saganova-${var.environment}-${each.value}"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage_gb
  max_allocated_storage = var.allocated_storage_gb * 4 # storage autoscaling ceiling
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = replace(each.value, "-", "_")
  username = "saganova"
  password = var.master_password
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  multi_az                  = var.environment == "production"
  backup_retention_period   = var.environment == "production" ? 30 : 7
  deletion_protection       = var.environment == "production"
  skip_final_snapshot       = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "saganova-${var.environment}-${each.value}-final" : null

  performance_insights_enabled = var.environment == "production"

  tags = {
    Environment = var.environment
    Project     = "saganova"
    Service     = each.value
  }
}
