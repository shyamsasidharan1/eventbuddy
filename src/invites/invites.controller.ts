import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBadRequestResponse, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { InvitesService } from './invites.service'
import { AcceptInviteDto } from './dto/accept-invite.dto'

@ApiTags('Invites')
@Controller('api/v1/invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Accept member invitation',
    description: 'Accept an invitation token and activate member account with password setup'
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        userId: { type: 'number', example: 123 },
        memberId: { type: 'number', example: 456 },
        message: { type: 'string', example: 'Welcome! Your account has been activated.' }
      }
    }
  })
  @ApiBadRequestResponse({
    description: 'Invalid token, user not found, or member already activated',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Member has already been activated or is not in invited status' },
        error: { type: 'string', example: 'Bad Request' }
      }
    }
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired invitation token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid or expired invite token' },
        error: { type: 'string', example: 'Unauthorized' }
      }
    }
  })
  async acceptInvite(@Body() acceptInviteDto: AcceptInviteDto) {
    const result = await this.invitesService.acceptInvite(
      acceptInviteDto.token,
      acceptInviteDto.password
    )

    return {
      ...result,
      message: 'Welcome! Your account has been activated.'
    }
  }
}