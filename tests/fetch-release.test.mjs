import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseGitHubRepo,
  releaseApiUrl,
  pickReleaseAsset,
} from '../lib/fetch-kit-release.mjs';

describe('fetch-kit-release helpers', () => {
  it('parses owner/repo', () => {
    assert.deepEqual(parseGitHubRepo('acme/mission-control-kit-v4'), {
      owner: 'acme',
      name: 'mission-control-kit-v4',
    });
  });

  it('builds latest release API URL', () => {
    assert.equal(
      releaseApiUrl('acme/mc-kit', 'latest'),
      'https://api.github.com/repos/acme/mc-kit/releases/latest',
    );
  });

  it('builds tagged release API URL', () => {
    assert.equal(
      releaseApiUrl('acme/mc-kit', '4.2.0'),
      'https://api.github.com/repos/acme/mc-kit/releases/tags/v4.2.0',
    );
  });

  it('picks tarball asset by pattern', () => {
    const asset = pickReleaseAsset(
      {
        assets: [
          { name: 'checksums.txt', browser_download_url: 'x' },
          { name: 'mission-control-kit-v4-4.2.0.tar.gz', browser_download_url: 'y' },
        ],
      },
      'mission-control-kit',
    );
    assert.equal(asset.name, 'mission-control-kit-v4-4.2.0.tar.gz');
  });
});
