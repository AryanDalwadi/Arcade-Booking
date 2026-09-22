variable "aws_region" {
  description = "AWS region for all regional resources."
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Short name used in resource names and tags."
  type        = string
  default     = "arcade"
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "dev"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "kubernetes_version" {
  type    = string
  default = "1.31"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "deletion_protection" {
  description = "Protect stateful production resources from accidental deletion."
  type        = bool
  default     = false
}

variable "enable_dynamodb_analytics_projection" {
  description = "Create the optional derived analytics read model. PostgreSQL remains the source of truth."
  type        = bool
  default     = false
}
