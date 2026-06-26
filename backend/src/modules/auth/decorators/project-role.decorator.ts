import { SetMetadata } from '@nestjs/common';
import { PROJECT_ROLE_KEY } from '../guards/project.guard';

export const ProjectRole = (role: string) => SetMetadata(PROJECT_ROLE_KEY, role);
