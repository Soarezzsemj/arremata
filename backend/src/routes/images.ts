import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { checkImageRequest, fetchImage } from '../services/images';

export const imagesRouter = Router();


imagesRouter.get(
  '/:imageId',
  asyncHandler(async (req, res) => {
    const imageId = String(req.params.imageId);
    const width = req.query.w === undefined ? 843 : Number(req.query.w);
    checkImageRequest(imageId, width);

    const image = await fetchImage(imageId, width);
    res.set({
      'Content-Type': image.contentType,
      'Cache-Control': 'public, max-age=86400',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    res.send(image.body);
  }),
);
