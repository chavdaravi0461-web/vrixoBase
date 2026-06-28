import { Injectable, Optional } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(@Optional() configService?: ConfigService) {
    const clientID = configService?.get<string>('GOOGLE_CLIENT_ID') || '';
    super({
      clientID: clientID || 'unconfigured',
      clientSecret: clientID ? (configService?.get<string>('GOOGLE_CLIENT_SECRET') || '') : 'unconfigured',
      callbackURL: configService?.get<string>('GOOGLE_CALLBACK_URL') || 'https://vrixobase-api.onrender.com/api/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;
    const user = {
      googleId: id,
      email: emails?.[0]?.value,
      name: name?.givenName
        ? `${name.givenName} ${name.familyName ?? ''}`.trim()
        : emails?.[0]?.value?.split('@')[0],
      avatarUrl: photos?.[0]?.value,
      accessToken,
    };
    done(null, user);
  }
}
