import { Injectable, Optional } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(@Optional() configService?: ConfigService) {
    const clientID = configService?.get<string>('GITHUB_CLIENT_ID') || '';
    super({
      clientID: clientID || 'unconfigured',
      clientSecret: clientID ? (configService?.get<string>('GITHUB_CLIENT_SECRET') || '') : 'unconfigured',
      callbackURL: configService?.get<string>('GITHUB_CALLBACK_URL') || 'https://vrixobase-api.onrender.com/api/auth/github/callback',
      scope: ['user:email'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: (err: any, user: any) => void): Promise<any> {
    const { id, username, displayName, emails, photos } = profile;
    const user = {
      githubId: id,
      email: emails?.[0]?.value,
      name: displayName || username,
      avatarUrl: photos?.[0]?.value,
      accessToken,
    };
    done(null, user);
  }
}
